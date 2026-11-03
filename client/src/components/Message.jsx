import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import moment from 'moment'
import Markdown from 'react-markdown'
import Prism from 'prismjs'

const Message = ({message}) => {
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    Prism.highlightAll();
  }, [message.content]);

  return (
    <div>
        {message.role === 'user' ? (
          <div className='flex items-start justify-end my-4 gap-2'>
            <div className='flex flex-col gap-2 p-2 px-4 bg-slate-50 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md max-w-2xl'>
              <p className='text-sm dark:text-primary'>{message.content}</p>
              <span className='text-xs text-gray-400 dark:text-[#B1A6C0]'>
                {moment(message.timestamp).fromNow()}</span>
            </div>
            <img src={assets.user_icon} alt="" className='w-8 rounded-full'/>
          </div>
        ) : (
          <div className='inline-flex flex-col gap-2 p-2 px-4 max-w-2xl bg-primary/20 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md my-4'>
            {message.isImage ? (
              imgFailed ? (
                <a href={message.content} target='_blank' rel='noreferrer'
                   className='text-xs break-all underline'>
                  Image load aagala. Link: {message.content}
                </a>
              ) : (
                <img src={message.content} alt="generated" onError={() => setImgFailed(true)}
                     className='w-full max-w-md mt-2 rounded-md'/>
              )
            ) : (
              <div className='text-sm dark:text-primary reset-tw'>
                <Markdown>{message.content}</Markdown>
              </div>
            )}
            <span className='text-xs text-gray-400 dark:text-[#B1A6C0]'>{moment(message.timestamp).fromNow()}</span>
          </div>
        )}
    </div>
  )
}

export default Message