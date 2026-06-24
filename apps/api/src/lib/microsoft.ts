export interface MicrosoftUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string | null;
  department?: string | null;
}

export async function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUser> {
  const url =
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department';

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<MicrosoftUser>;
}

export async function getMicrosoftUserAvatar(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}
