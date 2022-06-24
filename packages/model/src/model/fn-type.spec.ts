/**
 * @jest-environment jsdom
 */
import { useRestQuery, createModel, createModelFromCA } from './fn-type';
import {
    Vue,
    CompositionAPI,
    defineComponent,
    onMounted,
    createApp,
    watch,
    h,
} from '../dep';
import { createClient } from '../clients';
import fetchMock from 'jest-fetch-mock';
import 'unfetch/polyfill'
import { getCurrentInstance, ref } from '@vue/composition-api';

Vue.use(CompositionAPI);
fetchMock.enableMocks();

const restClient = createClient('REST', {
    method: 'post',
    headers: {
        "content-type": 'application/x-www-form-urlencoded',
    },
    timeout: 10 * 1000,
});

let count = 0;

restClient.interceptors.request.use((params) => {
    if (params.url === '/') {
        expect(params.headers?.['content-type']).toBe('application/x-www-form-urlencoded');
    } else {
        expect(params.headers?.['content-type']).toBe('application/json');
    }

    return params;
});

restClient.interceptors.response.use(({ data, config }) => {
    if (config.url === '/') {
        ++count;
        return {
            a: `${count}`,
            b: `${count}`,
        };
    }
    return data;
});

describe('transform model success', () => {
    beforeEach(() => {
        fetchMock.resetMocks();
        fetchMock.doMock();
    });

    const MockModel = createModel(() => {
        const testVariablels = ref('1');
        const query = useRestQuery<{
            a: string;
            b: string;
        }>({
            url: '/',
            method: 'POST',
            variables() {
                return {
                    mockData: testVariablels.value,
                };
            },
            skip() {
                return !testVariablels.value;
            },
            updateQuery(before, after) {
                return {
                    a: '' + before?.a + after?.a,
                    b: '' + before?.b + after?.b,
                };
            }
        });

        const query1 = useRestQuery<{
            a: string;
            b: string;
        }>({
            url: '/test',
            headers: {
                "content-type": 'application/json'
            },
            skip: true,
        });

        return {
            info: query.info,
            testVariablels,
            fetchMore: query.fetchMore,
            refetch: query1.refetch,
        };
    });

    it('transform fn type model', done => {
        const div = document.createElement('div');
        const App = defineComponent({
            setup() {

                const params = createModelFromCA(MockModel);
                const vm = getCurrentInstance()!;
                // TODO就是简单意思一下，实际mock在上头写的
                fetchMock.mockResponse(JSON.stringify({}));

                // 手动mock一下
                vm.proxy.$root.rebornStore = {
                    getModelInstance: jest.fn(),
                    registerModel: jest.fn(),
                    restore: jest.fn(),
                    exportStates: jest.fn(),
                };

                vm.proxy.$root.rebornClient = {
                    rest: restClient,
                };

                const { model } = params.cotr();

                watch(() => model.info.data?.b, () => {
                    expect(typeof model.info.data?.a).toBe('string');
                    if (count < 3) {
                        expect(model.info.data?.a).toBe(count + '');
                        expect(model.info.data?.b).toBe(count + '');
                        // 第二次变化
                        model.testVariablels.value = '';
                    } else {
                        expect(model.info.data?.a).toBe('23');
                        expect(model.info.data?.b).toBe('23');
                    }
                    if (model.info.data?.a === '23') {
                        done();
                    }
                });

                onMounted(() => {
                    expect(typeof model.info.data).toBe('undefined');
                    model.refetch();

                    setTimeout(() => {
                        model.testVariablels.value = '123';
                    }, 100);

                    setTimeout(() => {
                        // 第三次变化
                        model.fetchMore({
                            mockData: '12',
                        });
                    }, 300);
                })
                return () => null;
            }
        });

        createApp({
            render: () => h(App)
        }).mount(div);
    });
});
