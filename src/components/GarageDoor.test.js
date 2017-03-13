import React from 'react';
import ReactDOM from 'react-dom';
import GarageDoor from './GarageDoor';

it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<GarageDoor />, div);
});
