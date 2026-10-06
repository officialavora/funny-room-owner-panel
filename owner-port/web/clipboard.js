export const setStringAsync=value=>navigator.clipboard.writeText(String(value));
export const getStringAsync=()=>navigator.clipboard.readText();
