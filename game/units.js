const METERS_PER_YARD=.9144;
const number=(n,d=1)=>Math.max(0,Number.isFinite(n)?n:0).toFixed(d).replace('.',',');
export const toYards=meters=>meters/METERS_PER_YARD;
export const yardsValue=meters=>number(toYards(meters));
export const metersValue=meters=>number(meters);
export const distanceText=meters=>`${yardsValue(meters)} yd (${metersValue(meters)} m)`;
export const distanceHTML=meters=>`<span class="unit-primary">${yardsValue(meters)} <span>yd</span></span><small class="unit-secondary">(${metersValue(meters)} m)</small>`;
export function populateCapacities(select){for(const option of select.options)option.textContent=distanceText(Number(option.value));}
