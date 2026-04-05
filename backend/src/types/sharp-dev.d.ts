/** Stub – sharp jest opcjonalny (npm i -D sharp tylko przy npm run logos:thumbs). */
declare module 'sharp' {
  const sharp: (input: Buffer) => {
    resize: (
      w: number,
      h: number,
      opts: { fit?: string; withoutEnlargement?: boolean },
    ) => {
      webp: (o: { quality?: number }) => { toBuffer: () => Promise<Buffer> };
    };
  };
  export default sharp;
}
