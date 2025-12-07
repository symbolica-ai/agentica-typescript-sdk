import type { NextConfig } from 'next';

import { withAgentica } from '@symbolica/agentica/next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
};

export default withAgentica(nextConfig);
