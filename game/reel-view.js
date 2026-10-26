// Screen-space equipment framing. The view model never moves the physical anchor.
export function reelViewport(width,height){
  const compact=width<=760||height<=560;
  const size=Math.round(Math.max(96,Math.min(compact?150:215,Math.min(width*.32,height*.25))));
  return {size,x:Math.round(width-size-(compact?12:28)),y:Math.round(Math.max(80,height-(compact?210:255)-size))};
}
