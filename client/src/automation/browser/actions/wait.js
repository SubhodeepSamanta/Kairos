export async function waitSeconds(
  seconds
) {

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        seconds * 1000
      )
  );

  return {
    success: true,
    seconds
  };
}