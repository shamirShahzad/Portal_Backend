import type { Request,Response,NextFunction } from "express";
import { ZodError } from "zod";

const errorMiddleware = (err:any,req:Request,res:Response,next:NextFunction)=>{
    if(err instanceof ZodError){
        const zodError = err as ZodError<any>;
        return res.status(400).json({
            success:false,
            message:"Validation Error",
            errors:zodError.issues.map((e)=>({
                path:e.path.join("."),
                message:e.message,
            })),
        });
    }
    res.json({
        status:res.status,
        message:err.message,
        success:false,
        stack:err.stack?.toString() || "No stack trace",
        data:{}
    })
}
export default errorMiddleware;