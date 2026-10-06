import {createContext,useContext} from 'react';
// Hidden room layers retain audio/membership; their decorative motion pauses.
export const VisualActivityContext=createContext(true);
export const useVisualActivity=()=>useContext(VisualActivityContext);

