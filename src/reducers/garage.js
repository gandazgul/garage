export const GARAGE_DOOR_OPEN = 'GARAGE_DOOR_OPEN';
export const GARAGE_DOOR_CLOSE = 'GARAGE_DOOR_CLOSE';

function garageDoor(state = {}, action) {
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