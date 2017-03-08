import React from 'react';
import {connect} from 'react-redux';
import {getInitialState, openDoor} from '../reducers/garage';

class GarageDoor extends React.Component {
    static propTypes = {
        isOpened: React.PropTypes.bool,
    };

    componentDidMount() {
        this.props.dispatch(getInitialState());
    }

    garageDoorClick(openOrClose) {
        this.props.dispatch(openDoor(openOrClose));
    }

    render() {
        const {isOpened} = this.props;

        if (isOpened === null) {
            return (<div className="spinner"/>);
        }

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