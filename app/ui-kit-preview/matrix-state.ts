// Sandbox rules only; never consumed by combat or persisted.
export const MATRIX_POINTS = 15;
export const MAX_RANK = 5;
export const upgradeNames = ['Calibration', 'Amplifier', 'Overdrive'] as const;
export const emptyMatrix = (): number[][] => Array.from({length:4},()=>[0,0,0]);
export const pointsLeft = (ranks:number[][]):number => MATRIX_POINTS-ranks.flat().reduce((sum,rank)=>sum+rank,0);
export function unlockReason(ranks:number[][],branch:number,tier:number):string|null {
 if(!Number.isInteger(branch)||!Number.isInteger(tier)||branch<0||branch>=4||tier<0||tier>=3)return 'Unknown upgrade';
 if(ranks[branch][tier]>=MAX_RANK)return 'Maximum rank reached';
 if(tier>0&&ranks[branch][tier-1]<MAX_RANK)return `Requires ${upgradeNames[tier-1]} ${MAX_RANK}/${MAX_RANK}`;
 if(pointsLeft(ranks)<=0)return 'No skill points left. Reset sandbox points to try another build.';
 return null;
}
export function allocatePoint(ranks:number[][],branch:number,tier:number):number[][] {
 if(unlockReason(ranks,branch,tier))return ranks;
 return ranks.map((row,index)=>index===branch?row.map((rank,t)=>t===tier?rank+1:rank):row);
}
