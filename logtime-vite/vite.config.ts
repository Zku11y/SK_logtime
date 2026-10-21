import {defineConfig} from 'vite';
import {fileURLToPath, URL} from 'node:url';
import react from '@vitejs/plugin-react';
// The raw POST body is forwarded unchanged, using this computer's LAN access.
const proxy = {
 '/api/get_log': {target: 'https://logtime-med.1337.ma', changeOrigin: true, secure: true, timeout: 20000, proxyTimeout: 20000},
};
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},plugins:[react()],server:{host:'127.0.0.1',port:5173,strictPort:true,proxy},preview:{host:'127.0.0.1',port:4173,strictPort:true,proxy}});
