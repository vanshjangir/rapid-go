export const PlayButton = (
  {label, gametype, handler}:{
    label: string;
    gametype: string;
    handler: (gameType: string) => void;
  }
) => {
  return (
    <button
      onClick={() => handler(gametype)}
      className="w-[464px] text-4xl font-bold py-6 bg-[#614231] rounded hover:bg-[#715241] focus:outline-none focus:ring hover:shadow-[0_0_20px_5px_#715241]"
    >
      {label}
    </button>
  );
};


export const ReconnectButton = (
  {handler}:{
    handler: () => void;
  }
) => {
  return (
    <button
      onClick={handler}
      className="w-[200px] py-3 bg-red-600 rounded hover:bg-red-500 focus:outline-none focus:ring focus:ring-blue-300"
    >
      Reconnect
    </button>
  );
};
