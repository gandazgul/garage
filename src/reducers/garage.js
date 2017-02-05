export const GARAGE_DOOR_OPEN = 'GARAGE_DOOR_OPEN';
export const GARAGE_DOOR_CLOSE = 'GARAGE_DOOR_CLOSE';

export const getInitialState = () => (dispatch) => {
    fetch('http://localhost:4000/api').then(function (response) {
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
