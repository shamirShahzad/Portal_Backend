export const fillEmptyObject = (source: any, fallback: any) => {
  const result = { ...source };
  for (const key in fallback) {
    if (result[key] == undefined || result[key] == null) {
      result[key] = fallback[key];
    }
  }
  return result;
};

export const createNotFoundError = (message: string) => {
  return new Error(`${message} not found.`);
};
