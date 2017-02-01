import React from 'react';
import {connect} from 'react-redux';
import {GARAGE_DOOR_OPEN, GARAGE_DOOR_CLOSE} from '../reducers/garage';

class GarageDoor extends React.Component {
    static propTypes = {
        isOpened: React.PropTypes.bool,
    };

    garageDoorClick(openOrClose) {
        this.props.dispatch({
            type: openOrClose === 'open' ? GARAGE_DOOR_OPEN : GARAGE_DOOR_CLOSE,
        });
    }

    render() {
        const {isOpened} = this.props;

        if (isOpened) {
            return (
                <img src="/assets/garage-opened.png" alt="Garage door opened"
                     onClick={this.garageDoorClick.bind(this, 'close')}
                />
            );
        }
        else {
            return (
                <img src="/assets/garage-closed.png" alt="Garage door closed"
                     onClick={this.garageDoorClick.bind(this, 'open')}
                />
            );
        }
    }
}

const mapStateToProps = (state) => ({
    isOpened: state.garageDoor.isOpened,
});

export default connect(mapStateToProps)(GarageDoor);