export const LOAD_TIMEOUT_MS = 20_000;
export function withLoadTimeout<T>(
  work: Promise<T>,
  ms = LOAD_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "তথ্য আনতে সময় বেশি লাগছে। ইন্টারনেট সংযোগ যাচাই করে আবার চেষ্টা করুন।",
          ),
        ),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
