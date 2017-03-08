export const GARAGE_DOOR_OPEN = 'GARAGE_DOOR_OPEN';
export const GARAGE_DOOR_CLOSE = 'GARAGE_DOOR_CLOSE';

export const openDoor = (openOrClose) => (dispatch) => {
    const state = openOrClose === 'open' ? 1 : 0;
    const headers = new Headers();
    headers.append('content-type', 'application/json');

    fetch('/api', {method: 'POST', body: JSON.stringify({state}), headers,}).then((response) => {
        return response.text();
    }).then(function (response) {
        console.log('response', response);

        dispatch({
            type: openOrClose === 'open' ? GARAGE_DOOR_OPEN : GARAGE_DOOR_CLOSE,
        });
    }).catch((err) => console.error(err));
};

export const getInitialState = () => (dispatch) => {
    fetch('/api').then(function (response) {
        return response.json();
    }).then(function (response) {
        dispatch({
            type: response.isOpened ? GARAGE_DOOR_OPEN : GARAGE_DOOR_CLOSE,
        });
    });
};

const initialState = {
    isOpened: null,
};

function garageDoor(state = initialState, action) {
    switch (action.type) {
        case GARAGE_DOOR_CLOSE:
            return {
                ...state,
                isOpened: false,
            };
        case GARAGE_DOOR_OPEN:
            return {
                ...state,
                isOpened: true,
            };
        default:
            return state;
    }
}

export default garageDoor;
