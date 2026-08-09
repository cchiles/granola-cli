import type { Folder, ListFoldersOutput } from "../api/types"

export function formatFolders(data: ListFoldersOutput): string {
  if (data.folders.length === 0) return "No folders found."

  const lines = data.folders.map((folder) => formatFolderLine(folder))
  return lines.join("\n")
}

function formatFolderLine(folder: Folder): string {
  const parent = folder.parent_folder_id ? `  parent=${folder.parent_folder_id}` : ""
  return `  ${folder.id}  ${folder.name}${parent}`
}
