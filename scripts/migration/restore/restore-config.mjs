import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const defaultExportDir = "C:\\Users\\lu\\pubcore-migration-export";
export const defaultBackupPath = `${defaultExportDir}\\pubcore_260730.backup`;
export const defaultTocPath = `${defaultExportDir}\\backup_toc.txt`;

export function getBackupPath() {
  return resolve(process.argv[2] || process.env.LOVABLE_BACKUP_PATH || defaultBackupPath);
}

export function getTocPath() {
  return resolve(process.env.LOVABLE_BACKUP_TOC || defaultTocPath);
}

export function readToc() {
  const tocPath = getTocPath();
  if (!existsSync(tocPath)) {
    throw new Error(`TOC file not found: ${tocPath}. Generate it with pg_restore --list first.`);
  }
  const buffer = readFileSync(tocPath);
  const text = buffer[0] === 0xff && buffer[1] === 0xfe
    ? buffer.toString("utf16le")
    : buffer.toString("utf8");
  return { tocPath, text: text.replace(/^\uFEFF/, "") };
}

export function parseToc(text) {
  const lines = text.split(/\r?\n/);
  const metadata = {};
  const entries = [];
  const knownSections = [
    "TABLE DATA",
    "PUBLICATION TABLE",
    "TABLE ATTACH",
    "DEFAULT ACL",
    "FK CONSTRAINT",
    "ROW SECURITY",
    "TRIGGER",
    "POLICY",
    "INDEX",
    "CONSTRAINT",
    "SEQUENCE OWNED BY",
    "SEQUENCE SET",
    "SEQUENCE",
    "TABLE",
    "FUNCTION",
    "TYPE",
    "SCHEMA",
    "EXTENSION",
    "COMMENT",
    "ACL",
  ];

  for (const line of lines) {
    const archiveCreatedMatch = line.match(/^;\s+Archive created at\s+(.+)$/);
    if (archiveCreatedMatch) {
      metadata["Archive created at"] = archiveCreatedMatch[1].trim();
      continue;
    }

    const metadataMatch = line.match(/^;\s{4,}([^:]+):\s*(.+)$/);
    if (metadataMatch) {
      metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
      continue;
    }

    const prefixMatch = line.match(/^(\d+);\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!prefixMatch) continue;

    const [, tocId, catalogOid, objectOid, rest] = prefixMatch;
    const section = knownSections.find((candidate) => rest.startsWith(`${candidate} `));
    if (!section) continue;

    const remainder = rest.slice(section.length + 1);
    const parts = remainder.split(/\s+/);
    if (parts.length < 2) continue;

    const schema = parts.shift();
    const owner = parts.pop();
    const name = parts.join(" ");
    if (schema === "-" || schema === "ATTACH") continue;
    entries.push({
      tocId: Number(tocId),
      catalogOid: Number(catalogOid),
      objectOid: Number(objectOid),
      section,
      schema,
      name,
      owner,
      raw: line,
    });
  }

  return { metadata, entries };
}

export function backupDirForDocker(backupPath) {
  return resolve(backupPath).replace(/\\/g, "/").replace(/\/[^/]+$/, "");
}

export function backupFileName(backupPath) {
  return resolve(backupPath).split(/[\\/]/).pop();
}
