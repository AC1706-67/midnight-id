import React from 'react';
import { IssuerPanel } from './components/IssuerPanel';
import { ParticipantPanel } from './components/ParticipantPanel';

const App: React.FC = () => (
  <div>
    <IssuerPanel />
    <ParticipantPanel />
  </div>
);

export default App;
