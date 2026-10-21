import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** 每次构建都不一样：有 git 就用提交号 + 时间，没有就纯时间戳 */
function makeBuildId(): string {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}` +
    `.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return `${sha}.${stamp}`;
  } catch {
    return stamp;
  }
}

const buildId = makeBuildId();
const versionInfo = { version: pkg.version, buildId, builtAt: new Date().toISOString() };

/**
 * 产出 version.json，并让 dev server 也能访问。
 * 前端把自己的 __BUILD_ID__ 和这份对比，不一致就是有新版本。
 */
function versionPlugin(): Plugin {
  return {
    name: 'save100-version',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/version.json') return next();
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(JSON.stringify(versionInfo));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionInfo, null, 2),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // 部署在 https://xiaoshuai-y.github.io/save100/，构建时要用子路径；本地 dev 还是根路径
  base: command === 'build' ? '/save100/' : '/',
  server: { host: true, port: 5190 },
  build: { target: 'es2020' },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [versionPlugin()],
}));
