import { createSSRApp, h } from 'vue';

import { createStore, createClient, createCache } from '../../src/index';
import App from './App.vue';
import { createRouter } from './router';

type Fetch = typeof fetch

export function createApp(customFetch?: Fetch) {
    const router = createRouter();
    const store = createStore();
    const cache = createCache();

    const f = customFetch || window.fetch.bind(window);
    const restClient = createClient('REST', {
        fetch: f,
        cache,
    });

    restClient.interceptors.request.use(req => {
        req.url = `http://localhost:5173${req.url}`;
        return req;
    })

    restClient.interceptors.response.use(res => {
        return res.data;
    });

    store.registerClient('REST', restClient);
    const app = createSSRApp({
        render: () => h(App),
    });

    app.use(store);
    app.use(router);

    return { app, router, cache };
}