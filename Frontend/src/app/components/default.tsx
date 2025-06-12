import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';

type Props = {
  referencePitch: { time: number; frequency: number }[];
  alignedGraphData: { time: number; user: number; reference: number }[];
  countMatches: (data: any[]) => number;
};

export default function Default({
  referencePitch,
  alignedGraphData,
  countMatches,
}: Props) {
  const router = useRouter();

  return (
    <>
      <div>{referencePitch.length > 0 && (
        <LineChart width={500} height={300} data={referencePitch}>
          <XAxis dataKey="time" tick={{ fontSize: 14 }} />
          <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
          <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
        </LineChart>
      )}</div>

      <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
        <>
          <LineChart width={500} height={300} data={alignedGraphData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
            <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
            <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
          </LineChart>
          <p className="text-lg mt-2 text-center text-white">
            You were {(countMatches(alignedGraphData) * 100).toFixed(1)}% accurate!
          </p>
        </>
      )}</div>
    </>
  );
}
