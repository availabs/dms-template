import React, {useContext, useEffect, useRef, useState, useCallback} from "react";
import {isEqual} from "lodash-es";
import {ComponentContext} from "../../../dms/packages/dms/src/patterns/page/context";

const isJson = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
);

const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const VolumeIcon = ({muted}) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        {muted ? (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        ) : (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        )}
    </svg>
);

function Player({src}) {
    const audioRef = useRef(null);
    const progressRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    }, [src]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
        } else {
            audio.play();
        }
        setPlaying(!playing);
    }, [playing]);

    const handleTimeUpdate = useCallback(() => {
        setCurrentTime(audioRef.current?.currentTime || 0);
    }, []);

    const handleLoadedMetadata = useCallback(() => {
        setDuration(audioRef.current?.duration || 0);
    }, []);

    const handleEnded = useCallback(() => {
        setPlaying(false);
        setCurrentTime(0);
    }, []);

    const handleProgressClick = useCallback((e) => {
        const audio = audioRef.current;
        const bar = progressRef.current;
        if (!audio || !bar || !duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
        setCurrentTime(audio.currentTime);
    }, [duration]);

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-3">
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />
            <button
                onClick={togglePlay}
                className="flex-none size-9 flex items-center justify-center rounded-full border border-[#191919] text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
                {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="flex-none text-xs font-light text-slate-500 w-[3.25rem] text-right tabular-nums">
                {formatTime(currentTime)}
            </span>
            <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="flex-1 h-1.5 bg-[#E0EBF0] rounded-full cursor-pointer relative"
            >
                <div
                    className="absolute inset-y-0 left-0 bg-slate-500 rounded-full transition-[width] duration-100"
                    style={{width: `${progress}%`}}
                />
            </div>
            <span className="flex-none text-xs font-light text-slate-500 w-[3.25rem] tabular-nums">
                {formatTime(duration)}
            </span>
            <button
                onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    audio.muted = !muted;
                    setMuted(!muted);
                }}
                className="flex-none text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
                <VolumeIcon muted={muted} />
            </button>
        </div>
    );
}

const Edit = ({value, onChange}) => {
    const {state, setState} = useContext(ComponentContext);
    const cachedData = value && isJson(value) ? JSON.parse(value) : {};
    const title = state?.display?.title ?? cachedData?.title ?? '';
    const audioUrl = state?.display?.audioUrl ?? cachedData?.audioUrl ?? '';

    useEffect(() => {
        const newData = {
            title: state?.display?.title ?? '',
            audioUrl: state?.display?.audioUrl ?? ''
        };
        const currentData = value && isJson(value) ? JSON.parse(value) : {};

        if (!isEqual(newData, {title: currentData.title, audioUrl: currentData.audioUrl})) {
            onChange(JSON.stringify(newData));
        }
    }, [state?.display?.title, state?.display?.audioUrl]);

    // Initialize state.display from saved data on mount
    useEffect(() => {
        if (cachedData?.title !== undefined || cachedData?.audioUrl !== undefined) {
            setState(draft => {
                if (!draft.display) draft.display = {};
                if (cachedData.title !== undefined) draft.display.title = cachedData.title;
                if (cachedData.audioUrl !== undefined) draft.display.audioUrl = cachedData.audioUrl;
            });
        }
    }, []);

    return (
        <div className="p-4 rounded-lg border border-[#E0EBF0] space-y-3">
            {title && <p className="text-lg font-light tracking-wide text-slate-700">{title}</p>}
            {audioUrl ? (
                <Player src={audioUrl} />
            ) : (
                <p className="text-sm text-slate-400 italic">No audio URL set</p>
            )}
        </div>
    );
}

const View = ({value}) => {
    const cachedData = value && isJson(value) ? JSON.parse(value) : {};
    const title = cachedData?.title ?? '';
    const audioUrl = cachedData?.audioUrl ?? '';

    return (
        <div className="p-4 rounded-lg border border-[#E0EBF0] space-y-3">
            {title && <p className="text-lg font-light tracking-wide text-slate-700">{title}</p>}
            {audioUrl ? (
                <Player src={audioUrl} />
            ) : null}
        </div>
    );
}

export default {
    name: 'Audio Player',
    EditComp: Edit,
    ViewComp: View,
    defaultState: {
        display: {title: '', audioUrl: ''}
    },
    controls: {
        default: [
            {type: 'input', inputType: 'text', label: 'Title', key: 'title'},
            {type: 'input', inputType: 'text', label: 'Audio URL', key: 'audioUrl'}
        ]
    }
}
