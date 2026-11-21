export interface SourceRef { id: string; name: string; url: string; fetchedAt: string }
export interface Point { period: string; value: number }
export interface Role { id: string; name: string }
export interface DemandResponse { role: Role; current: number; changePct: number; series: Point[]; source: SourceRef }
export interface SkillRow { skill: string; share: number; changePct: number; source: SourceRef }
export interface SkillsResponse { role: Role; skills: SkillRow[] }
