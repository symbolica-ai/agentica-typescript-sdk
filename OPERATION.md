# Agentica System Operation

This document is meant to describe the operational architecture of the Agentica system, focusing on how TypeScript and Python runtimes communicate via RPC to enable cross-language agentic execution.

**TOC**

* Core Architecture
* Part I: The transformer
* Part II: The frame model, RPC, and object virtualization
* Part III: The Futures Mechanism
* Part IV: Server session manager, sandbox, transcoder


--------------------------------------------------------------------------------

## Core Architecture

### Three-Layer Message Flow

```
TypeScript SDK (Client) 
    ↕ WebSocket + JSON (Universal messages)
ServerSessionManager (Transcoder)
    ↕ MessagePack (Python RPC messages)  
Python AgentWorld (Sandbox)
```

1. **TypeScript SDK Layer**: Manages frame runtime, encodes TypeScript values and types into universal message format
2. **Transcoding Layer**: Converts between TypeScript-friendly JSON messages and Python msgpack RPC messages
3. **Python Agent Layer**: Executes Python code in sandboxed environments, manages virtual resources


--------------------------------------------------------------------------------

## Part I: The transformer

TODO

--------------------------------------------------------------------------------

## Part II: The frame model, RPC, and object virtualization

TODO


### Request/Response Messages

- `RequestMsg`/`FramedRequestMsg`: RPC function calls, property access, method invocations
- `ResponseMsg`/`FramedResponseMsg`: Results from RPC operations
- Contains `defs` (type definitions) and `data` (actual values)

### Event Messages (Sideband)

- `FutureEventMsg`: Asynchronous notifications about future completion/cancellation
  - `FutureCompletedMsg`: Sent when a future resolves with a value/error
  - `FutureCanceledMsg`: Sent when a future is cancelled
- `ChannelMsg`: For streaming/generator communication

### Frame Hierarchy

Frames track nested RPC scopes:

```
World
 └─ Frame[0] (root)
     ├─ Frame[1] (nested call context)
     └─ Frame[2] (parallel call context)
```

Each frame (except root, id 0) has:
- Frame ID
- Remote parent frame ID (the remote frame that made the request that caused this frame)
- Encoding/decoding context for that scope

### Virtualization (by example: functions)

When TypeScript passes a function to Python:

1. **Encoding** (TypeScript → Python):
   - Function metadata sent in `defs`: name, arguments, return type, `async_mode`
   - Assigned a unique resource ID

2. **Decoding** (Python receives):
   - `create_virtual_function()` generates Python function stub (virtual_function.py:115-184)
   - Stub captures calls and converts them to RPC
   - For async functions with `async_mode='future'`, return type is wrapped in `asyncio.Future[T]`

3. **Calling**:
   - Python calls virtual function
   - Generates `ResourceCallFunction` request
   - Sends to TypeScript via RPC
   - Returns a Future immediately

### (Python) Resource Handles

Every virtual resource (function, object, future) has:
- `ResourceHandle`: Python-side wrapper
- `ResourceData`: Metadata for encoding/decoding
- `grid` (GlobalRID): Unique identifier across worlds

--------------------------------------------------------------------------------

## Part III: The Futures Mechanism

### Problem: Cross-Runtime Async Synchronization

TypeScript Promises and Python `asyncio.Future` objects need to stay synchronized across the RPC boundary. When a TypeScript function returns a Promise, the Python side needs a Future that resolves when the Promise resolves.

**Solution: Mirrored Futures with Event-Based Synchronization** Futures exist in *pairs* - one in TypeScript, one in Python - both identified by the same `FutureID`.

#### Future Creation (Case 3.2 from FUTURES.MD)

When calling a virtual function that returns a Future:

1. **TypeScript side** (SDK):
   - Function call creates a Promise
   - Returns `{ kind: 'obj', cls: Future, keys: ['then', 'catch', 'finally'] }`
   - Promise is registered with a unique resource ID

2. **Python side** (Agent):
   - `execute_outgoing_request_future()` is called (agent_world.py:118-132)
   - Sends the request immediately
   - Creates an `awaiting[mid]` future for the response
   - Calls `future_from_id(mid)` to create a user-facing future
   - This future gets `add_done_callback` attached to decode the response

3. **Critical hook** (agent_world.py:142-144):
   ```python
   def _await_future(self, future: FutureT, _: None):
       with self.log_as('on_virtual_future_await', future) as ctx:
           self.start_futures_task(future.get_loop())
   ```
   - This hook is called from `HookableFuture.__await__()` (futures.py:54-59)
   - Starts the `futures_task` which runs the message loop

#### The futures_task Message Loop

Once started (agent_world.py:260-331):

```python
async def futures_task(self) -> None:
    while len(awaiting) or len(futures):
        await sleep(0)  # Yield to other tasks
        msg: RPCMsg = self.__recv_msg(ctx)  # Blocking recv
        
        if isinstance(msg, FramedResponseMsg):
            # Complete awaiting future
            future.set_result(msg)
            
        elif isinstance(msg, FutureEventMsg):
            # Handle future completion from remote
            self.handle_future_event_msg(msg)
```

**Key point**: This task runs **only while there are outstanding futures**. It processes both:
- `FramedResponseMsg`: RPC responses
- `FutureEventMsg`: Async notifications about future state changes

#### Future Completion Synchronization

When a TypeScript Promise resolves:

1. TypeScript SDK sends `FutureCompletedMsg`:
   ```json
   {
     "kind": "future_completed",
     "future_id": 1764,
     "result": { "kind": "result", "payload": { "result": { "kind": "str", "val": "..." } } }
   }
   ```

2. Transcoder converts to Python format:
   ```python
   FutureCompletedMsg(
       future_id=1764,
       result=ResultMsg(...),
       defs=(...)
   )
   ```

3. AgentWorld processes it (base_world.py:232-250):
   ```python
   def handle_future_event_msg(self, msg: FutureEventMsg) -> None:
       future_id = msg.future_id
       future = self.futures.get(future_id)
       future_request = msg.decode(self.root)  # CompleteFuture(future, result)
       del self.futures[future_id]
       future_request.execute()  # Calls future.set_result()
   ```


--------------------------------------------------------------------------------

## Part IV: Server session manager and sandbox

### Multi-Sandbox Environment

The ServerSessionManager can have multiple sandboxes simultaneously:

```
ServerSessionManager
  ├─ MagicAgent (uid=xxx)
  │   └─ Sandbox[0] (lead agent)
  │       └─ AgentWorld with PyWasmRunner
  │           └─ Python REPL executing agent code
  │
  ├─ MagicAgent (uid=yyy) 
  │   └─ Sandbox[1] (sub-agent 1)
  │       └─ AgentWorld with PyWasmRunner
  └─ ... (Sandbox[2-5] for other sub-agents)
```

Each sandbox is independent with:
- Its own inbox/outbox queues
- Its own AgentWorld instance
- Its own WebSocket connection to TypeScript client
- Separate message loop and futures tracking

### Message Routing

**Within a sandbox**:
1. TypeScript → `sdk_recv_bytes` → Transcoder → Sandbox inbox → AgentWorld recv_bytes
2. AgentWorld send_bytes → Sandbox outbox → Transcoder → `sdk_send_bytes` → TypeScript

**Cross-sandbox** (not implemented):
- No mechanism exists to route messages between sandboxes
- Sub-agent futures cannot notify parent agent directly
- This is the root cause of the multi-agent spawn stall

## The Transcoding Layer

### TranscodingInterceptor

Located in `common/src/agentica_internal/warpc_transcode/transcoder.py`:

```python
def intercept_sdk(recv_from_sdk, send_to_sdk):
    async def transcoded_recv_from_sdk() -> bytes:
        warpc_msg = await recv_from_sdk()  # JSON bytes from TypeScript
        rpc_msg = json_to_rpc_uni(warpc_msg)  # Parse to universal format
        py_msg = self.transcode_to_py(rpc_msg)  # Convert to Python RPC
        return py_msg.to_msgpack()  # Serialize for Python
    
    async def transcoded_send_to_sdk(data: bytes) -> None:
        rpc_msg = RPCMsg.from_msgpack(data)  # Deserialize from Python
        uni_msg = self.transcode_to_uni(rpc_msg)  # Convert to universal
        uni_msg_json = uni_to_json(uni_msg)  # Serialize to JSON
        await send_to_sdk(uni_msg_json)  # Send to TypeScript
```

### Definition Context

Maintains mappings between TypeScript and Python type definitions:
- Tracks `DefnUID` → `DefinitionMsg` for all transferred types
- Ensures consistent type interpretation across conversions
- Updated as new types flow through the system


### Message IDs as Future IDs

For RPC-initiated futures (case 3.2):
- The `MessageID` of the request becomes the `FutureID`
- Both caller and callee know this ID before the future exists
- Eliminates need for separate future ID allocation protocol
