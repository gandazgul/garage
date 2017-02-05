import {createStore, combineReducers, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';
import reducers from './reducers';

const store = createStore(
    combineReducers(reducers),
    applyMiddleware(thunk)
);

if (module.hot) {
    module.hot.accept('./reducers/index', () => {
        const nextReducer = combineReducers(require('./reducers/index'));
        store.replaceReducer(nextReducer);
    });
}


export default store;