import { getAccessToken } from './drive-auth';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
}

/**
 * Lists files from Google Drive. Can optionally filter for specific file types.
 */
export async function listDriveFiles(filterSpreadsheetsOnly: boolean = false): Promise<DriveFile[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Unauthorized: No active Google Workspace session');
  }

  const queryParams = new URLSearchParams({
    pageSize: '50',
    fields: 'files(id,name,mimeType,size,createdTime)',
    orderBy: 'modifiedTime desc',
    q: "trashed = false" + (filterSpreadsheetsOnly ? " and mimeType = 'application/vnd.google-apps.spreadsheet'" : "")
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error: ${response.statusText} (${errText})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Fetch a Google Sheet by its ID and format its content as a clean CSV string
 */
export async function fetchGoogleSheetAsCSV(spreadsheetId: string, sheetName?: string): Promise<{ sheetName: string; csv: string; title: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Unauthorized: No active Google Workspace session');
  }

  // 1. Get spreadsheet metadata to find the sheet names
  const metaResponse = await fetch(`https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}?fields=properties(title),sheets(properties(title))`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaResponse.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const title = metaData.properties?.title || 'Untitled Spreadsheet';
  const sheets = metaData.sheets || [];
  
  if (sheets.length === 0) {
    throw new Error('Spreadsheet does not contain any sheets.');
  }

  // Use specified sheet or the first one
  const targetSheetName = sheetName || sheets[0].properties?.title || 'Sheet1';

  // 2. Fetch sheet values
  const encodedSheetName = encodeURIComponent(targetSheetName);
  const valuesResponse = await fetch(`https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}?valueRenderOption=FORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!valuesResponse.ok) {
    throw new Error(`Failed to fetch sheet values: ${valuesResponse.statusText}`);
  }

  const valuesData = await valuesResponse.json();
  const rows: string[][] = valuesData.values || [];

  if (rows.length === 0) {
    return { sheetName: targetSheetName, csv: '', title };
  }

  // Convert row array to CSV format
  const csvContent = rows.map(row => {
    return row.map(cell => {
      const cellStr = cell === null || cell === undefined ? '' : String(cell);
      // Escape double quotes and wrap in quotes if has commas/newlines/quotes
      if (cellStr.includes('"') || cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('\r')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',');
  }).join('\n');

  return {
    sheetName: targetSheetName,
    csv: csvContent,
    title
  };
}

/**
 * Fetches the metadata or text content of a generic document (e.g. Google Doc or plain text) from Google Drive.
 */
export async function fetchDriveFileContent(fileId: string, mimeType: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Unauthorized: No active Google Workspace session');
  }

  let fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  // If it's a Google Doc, we must export it as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else {
    // Standard file download
    fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to download Google Drive file: ${response.statusText}`);
  }

  return await response.text();
}
