import React from 'react';
import {connect as ioConnect} from 'socket.io-client';

import './GarageDoor.less';

class GarageDoor extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            error: null,
            isOpened: null,
            loading: true,
        };
    }

    componentDidMount() {
        this.socket = ioConnect(window.location.origin);

        this.socket.on('garage_error', (data) => {
            this.setState({
                error: data.message,
            });
        });

        this.socket.on('door_state', (data) => {
            this.setState({
                isOpened: data.isOpened,
                loading: false,
            });
        });
    }

    garageDoorClick(openOrClose) {
        this.socket.emit('trigger_door', {expectedState: openOrClose});
        this.setState({
            loading: true,
        });
    }

    render() {
        const {isOpened, error, loading} = this.state;

        if (error !== null) {
            return <p className="error-message">Error: {error}</p>
        }

        let src;
        if (isOpened) {
            src = "/static/garage-opened.png";
        }
        else {
            src = "/static/garage-closed.png";
        }

        return (
            <div className="garage-door">
                {loading ? <div className="spinner" /> : null}
                <img src={src} alt={`Garage door ${isOpened ? 'opened' : 'closed'}`}
                     onClick={this.garageDoorClick.bind(this, isOpened ? 'close' : 'open')}
                />
            </div>
        );
    }
}

export default GarageDoor;