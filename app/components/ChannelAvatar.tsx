import Image from "next/image";

const AVATAR_COLORS = [
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-amber-500",
  "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-teal-500",
  "bg-indigo-500", "bg-rose-500",
];

type Props = {
  channelId: string;
  name: string;
  iconUrl?: string | null;
  size?: number; // px
  className?: string;
};

export default function ChannelAvatar({ channelId, name, iconUrl, size = 40, className = "" }: Props) {
  const hash = channelId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const avatarColor = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const sizeClass = `h-[${size}px] w-[${size}px]`;

  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt={name}
        width={size}
        height={size}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${avatarColor} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name[0]}
    </div>
  );
}
