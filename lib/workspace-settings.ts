/** Construit une clé de réglage isolée pour un espace de travail. */
export function workspaceSettingKey(workspaceId: string, key: string): string {
  return `${workspaceId}:${key}`;
}
