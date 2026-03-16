import { CheckCircle, Circle, Play } from 'lucide-react';

export type StepStatus = 'pending' | 'active' | 'completed';

interface Step {
    id: string;
    label: string;
    status: StepStatus;
}

interface StepIndicatorProps {
    steps: Step[];
    className?: string;
}

export default function StepIndicator({ steps, className = '' }: StepIndicatorProps) {
    const getStepIcon = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return <CheckCircle size={16} className="text-green-400" />;
            case 'active':
                return <Play size={16} className="text-[#00F0FF] animate-pulse" />;
            case 'pending':
                return <Circle size={16} className="text-gray-600" />;
        }
    };

    return (
        <div className={`flex items-center justify-center gap-8 ${className}`}>
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                    {getStepIcon(step.status)}
                    <span className={`text-xs font-mono tracking-wider ${
                        step.status === 'active' ? 'text-[#00F0FF]' :
                        step.status === 'completed' ? 'text-green-400' :
                        'text-gray-500'
                    }`}>
                        {step.label}
                    </span>
                    {index < steps.length - 1 && (
                        <div className="w-6 h-px bg-gray-700 mx-2" />
                    )}
                </div>
            ))}
        </div>
    );
}