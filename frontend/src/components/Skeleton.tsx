import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', style = {} }) => {
  return <div className={`skeleton ${className}`} style={style}></div>;
};

export default Skeleton;
