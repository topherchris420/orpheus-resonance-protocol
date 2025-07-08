
import { useState } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  intensity: number;
}

interface InteractionStateResult {
  touchPoints: TouchPoint[];
  currentTimeline: number;
  temporalMoment: number;
  coherenceLevel: number;
  activeFrequency: number;
  addTouchPoint: (point: TouchPoint) => void;
  handleTemporalShift: (timeline: number, moment: number) => void;
  setCoherenceLevel: (level: number) => void;
  setActiveFrequency: (frequency: number) => void;
}

export const useInteractionState = (): InteractionStateResult => {
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);
  const [currentTimeline, setCurrentTimeline] = useState(0);
  const [temporalMoment, setTemporalMoment] = useState(0);
  const [coherenceLevel, setCoherenceLevel] = useState(0);
  const [activeFrequency, setActiveFrequency] = useState(432);

  const addTouchPoint = (point: TouchPoint) => {
    setTouchPoints(prev => [...prev.slice(-4), point]);
  };

  const handleTemporalShift = (timeline: number, moment: number) => {
    setCurrentTimeline(timeline);
    setTemporalMoment(moment);
  };

  return {
    touchPoints,
    currentTimeline,
    temporalMoment,
    coherenceLevel,
    activeFrequency,
    addTouchPoint,
    handleTemporalShift,
    setCoherenceLevel,
    setActiveFrequency
  };
};
