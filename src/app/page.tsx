import { Mic, Play } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center h-screen text-[50px]">
      <h1>mǎ 馬</h1>
      <div className="grid grid-cols-2 gap-4">
        <div><button className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600">
          <Mic />
        </button>
        </div>
        <div><button className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600">
          <Play />
        </button></div>
      </div>
    </main>
  );
}

