import React from 'react';

const Skeleton = ({ className }) => {
    return (
        <div className={`animate-pulse bg-card-bg/60 rounded-xl ${className}`} />
    );
};

export const CardSkeleton = () => (
    <div className="glass-card p-6 rounded-[32px] border border-card-border space-y-4">
        <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
            </div>
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
);

export const TableRowSkeleton = () => (
    <div className="flex items-center justify-between p-5 border-b border-card-border/50">
        <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
            </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
    </div>
);

export const HeaderSkeleton = () => (
    <div className="px-6 pt-6 space-y-4">
        <div className="flex items-center gap-5">
            <Skeleton className="w-20 h-20 rounded-[30px]" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
            </div>
        </div>
    </div>
);

export const InventorySkeleton = () => (
    <div className="pb-24 space-y-8 animate-pulse">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="glass-card rounded-[40px] p-7 h-64 border border-card-border/50">
                    <div className="flex justify-between mb-6">
                        <div className="w-20 h-20 bg-card-bg rounded-[28px]" />
                        <div className="space-y-2">
                            <div className="h-6 w-24 bg-card-bg rounded-lg" />
                            <div className="h-4 w-16 bg-card-bg rounded-lg" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="h-6 w-3/4 bg-card-bg rounded-lg" />
                        <div className="h-4 w-1/2 bg-card-bg rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const DashboardSkeleton = () => (
    <div className="pb-24 space-y-8 animate-pulse">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="glass-card p-6 rounded-[32px] border border-card-border h-32 flex flex-col justify-between">
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="w-10 h-10 rounded-xl" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
            <div className="lg:col-span-2 glass-card p-6 rounded-3xl h-[400px]">
                <div className="flex justify-between mb-6">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-full w-full rounded-2xl" />
            </div>
            <div className="glass-card p-6 rounded-3xl h-[400px] space-y-4">
                <Skeleton className="h-6 w-32" />
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-2 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-4 w-12" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default Skeleton;
