/**
 * Media Suite Core Module
 * Central orchestrator for all media processing operations
 */

import { ImageProcessor } from './processors/image.js';
import { VideoProcessor } from './processors/video.js';
import { AudioProcessor } from './processors/audio.js';
import { MetadataExtractor } from './utils/metadata.js';
import { MediaStorage } from './storage/storage.js';
import { JobQueue } from './queue/job-queue.js';

export class MediaSuite {
  constructor(env) {
    this.env = env;
    this.storage = new MediaStorage(env);
    this.queue = new JobQueue(env);
    
    // Initialize processors
    this.imageProcessor = new ImageProcessor(env);
    this.videoProcessor = new VideoProcessor(env);
    this.audioProcessor = new AudioProcessor(env);
    this.metadataExtractor = new MetadataExtractor(env);
  }

  /**
   * Process media based on type and requested operations
   */
  async processMedia(file, options = {}) {
    const job = await this.queue.createJob({
      type: 'media_processing',
      file: file,
      options: options,
      status: 'pending'
    });

    try {
      // Update job status
      await this.queue.updateJob(job.id, { status: 'processing' });

      // Extract metadata first
      const metadata = await this.metadataExtractor.extract(file);
      
      // Route to appropriate processor
      let result;
      switch (metadata.type) {
        case 'image':
          result = await this.imageProcessor.process(file, options);
          break;
        case 'video':
          result = await this.videoProcessor.process(file, options);
          break;
        case 'audio':
          result = await this.audioProcessor.process(file, options);
          break;
        default:
          throw new Error(`Unsupported media type: ${metadata.type}`);
      }

      // Store processed files
      const storedResults = await this.storage.store(result.files);

      // Complete job
      await this.queue.updateJob(job.id, {
        status: 'completed',
        result: storedResults,
        metadata: metadata
      });

      return {
        jobId: job.id,
        results: storedResults,
        metadata: metadata
      };

    } catch (error) {
      await this.queue.updateJob(job.id, {
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Batch process multiple files
   */
  async processBatch(files, options = {}) {
    const batchJob = await this.queue.createJob({
      type: 'batch_processing',
      files: files,
      options: options,
      status: 'pending'
    });

    const results = [];
    for (const file of files) {
      try {
        const result = await this.processMedia(file, options);
        results.push({ file: file.name, status: 'success', result });
      } catch (error) {
        results.push({ file: file.name, status: 'error', error: error.message });
      }
    }

    await this.queue.updateJob(batchJob.id, {
      status: 'completed',
      results: results
    });

    return results;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    return await this.queue.getJob(jobId);
  }

  /**
   * List all jobs with optional filtering
   */
  async listJobs(filter = {}) {
    return await this.queue.listJobs(filter);
  }

  /**
   * Get media library with search and pagination
   */
  async getMediaLibrary(options = {}) {
    return await this.storage.listMedia(options);
  }

  /**
   * Delete media file and all associated processed versions
   */
  async deleteMedia(mediaId) {
    return await this.storage.delete(mediaId);
  }

  /**
   * Get processing statistics
   */
  async getStats() {
    const [jobStats, storageStats] = await Promise.all([
      this.queue.getStats(),
      this.storage.getStats()
    ]);

    return {
      jobs: jobStats,
      storage: storageStats,
      processors: {
        image: this.imageProcessor.getCapabilities(),
        video: this.videoProcessor.getCapabilities(),
        audio: this.audioProcessor.getCapabilities()
      }
    };
  }
}

export default MediaSuite;