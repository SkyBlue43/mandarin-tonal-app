import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { Play, Mic, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Props = {
  handlePlay: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  recording: boolean;
  referencePitch: { time: number; frequency: number }[];
  alignedGraphData: { time: number; user: number; reference: number }[];
  countMatches: (data: any[]) => number;
};

export default function OneWord({
  handlePlay,
  startRecording,
  stopRecording,
  recording,
  referencePitch,
  alignedGraphData,
  countMatches,
}: Props) {
  const router = useRouter();

  return (
    <>
      <div className='flex justify-center items-center w-full h-full'>
        <button className="p-4 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
          <Play />
        </button>
        <button
          className={`p-4 rounded-full text-white ${recording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          onClick={recording ? stopRecording : startRecording}>
          {recording ? <Square /> : <Mic />}
        </button>
      </div>

      <div>{referencePitch.length > 0 && (
        <LineChart width={400} height={300} data={referencePitch}>
          <XAxis dataKey="time" tick={{ fontSize: 14 }} />
          <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
          <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
        </LineChart>
      )}</div>

      <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
        <>
          <LineChart width={400} height={300} data={alignedGraphData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
            <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
            <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
          </LineChart>
          <p className="text-lg mt-2 text-center text-white">
            You were {(countMatches(alignedGraphData) * 100).toFixed(1)}% accurate!
          </p>
          <div>
            {(countMatches(alignedGraphData) * 100) > 90 && (
              <button className='bg-green-500 p-4 text-lg text-center rounded-3xl' onClick={() => router.push('/nextPage')}>
                Success! Next?
              </button>
            )}
          </div>
        </>
      )}</div>
    </>
  );
}
