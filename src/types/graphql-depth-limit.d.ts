declare module 'graphql-depth-limit' {
  import { ValidationContext } from 'graphql';
  
  function depthLimit(maxDepth: number, options?: { ignore?: string[] }, callback?: (depth: number) => void): (context: ValidationContext) => ValidationContext;
  
  export default depthLimit;
}
