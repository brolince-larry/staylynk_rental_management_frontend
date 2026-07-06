import React from 'react'
import { LazyImage, type LazyImageProps } from './LazyImage'

export function ProgressiveImage(props: LazyImageProps): React.ReactElement {
  return <LazyImage {...props} />
}
