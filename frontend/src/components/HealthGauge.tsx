import { useRef, useEffect } from 'react';

export default function HealthGauge({ score }: { score: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 50;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background Ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();

        // Score Ring
        const startAngle = -0.5 * Math.PI;
        const endAngle = (2 * Math.PI * (score / 100)) - 0.5 * Math.PI;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        // Gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#00F0FF');
        gradient.addColorStop(1, '#00FF41');
        ctx.strokeStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00F0FF';
        ctx.stroke();

        // Text
        ctx.font = 'bold 24px Rajdhani';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(`${score}%`, centerX, centerY);

    }, [score]);

    return <canvas ref={canvasRef} width={120} height={120} className="mx-auto" />;
}
