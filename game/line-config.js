// Internal units stay metric. The last two reels are exactly 300 and 1,000 yd.
export const LINE_CAPACITIES=Object.freeze([30,65,100,150,274.32,914.4]);
export const MAX_LINE_CAPACITY=LINE_CAPACITIES.at(-1);
export const WEAR_STEP=.125;
export const WEAR_SAMPLES=Math.ceil(MAX_LINE_CAPACITY/WEAR_STEP)+1;
export const cleanHeightRecord=value=>Number.isFinite(value)&&value>=0&&value<=MAX_LINE_CAPACITY+10?value:0;
