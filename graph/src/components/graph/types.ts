export interface AppInfo {
  name: string
  techStack: string[]
  swaggerUrl?: string
  sliceCount: number
}

export interface SliceInfo {
  name: string
  path: string
  fileCount: number
  type: 'setup' | 'feature'
  parent: string | null
  subsliceCount: number
  app: string
  domainCount: number
  dataCount: number
  viewCount: number
  hasReadme: boolean
  hasRepositoryFile: boolean
}

export interface EdgeInfo {
  from: string
  to: string
  count: number
}
