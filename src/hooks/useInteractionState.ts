import { useState } from 'react';

interface InteractionEvent {
  x: number;
  y: number;
  intensity: number;
}

interface InteractionStateResult {
  interactionEvents: InteractionEvent[];
  currentTimeline: number;
  temporalMoment: number;
  cohesionScore: number;
  bioResonanceFrequency: number;
  addInteractionEvent: (event: InteractionEvent) => void;
  handleTemporalShift: (timeline: number, moment: number) => void;
  setCohesionScore: (score: number) => void;
  setBioResonanceFrequency: (frequency: number) => void;
}

export const useInteractionState = (): InteractionStateResult => {
  const [interactionEvents, setInteractionEvents] = useState<InteractionEvent[]>([]);
  const [currentTimeline, setCurrentTimeline] = useState(0);
  const [temporalMoment, setTemporalMoment] = useState(0);
  const [cohesionScore, setCohesionScore] = useState(0);
  const [bioResonanceFrequency, setBioResonanceFrequency] = useState(40);

  const addInteractionEvent = (event: InteractionEvent) => {
    setInteractionEvents(prev => [...prev.slice(-4), event]);
  };

  const handleTemporalShift = (timeline: number, moment: number) => {
    setCurrentTimeline(timeline);
    setTemporalMoment(moment);
  };

  return {
    interactionEvents,
    currentTimeline,
    temporalMoment,
    cohesionScore,
    bioResonanceFrequency,
    addInteractionEvent,
    handleTemporalShift,
    setCohesionScore,
    setBioResonanceFrequency
  };
};
