import * as tf from '@tensorflow/tfjs';

class PredictionService {
  constructor() {
    this.model = null;
    this.isModelReady = false;
  }

  // Create and train a simple sequential model
  async trainModel(trainingData) {
    try {
      // trainingData should be array of {timestamp, cleanliness, occupancy}
      if (trainingData.length < 10) {
        console.warn('Not enough data to train model');
        return false;
      }

      // Prepare data
      const xs = trainingData.map((d, i) => i);  // Time index
      const ys = trainingData.map(d => d.cleanliness);

      // Create tensors
      const xTensor = tf.tensor2d(xs, [xs.length, 1]);
      const yTensor = tf.tensor2d(ys, [ys.length, 1]);

      // Normalize
      const xMean = xTensor.mean();
      const xStd = xTensor.sub(xMean).square().mean().sqrt();
      const xNorm = xTensor.sub(xMean).div(xStd);

      const yMean = yTensor.mean();
      const yStd = yTensor.sub(yMean).square().mean().sqrt();
      const yNorm = yTensor.sub(yMean).div(yStd);

      // Create model
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [1], units: 10, activation: 'relu' }),
          tf.layers.dense({ units: 5, activation: 'relu' }),
          tf.layers.dense({ units: 1 })
        ]
      });

      // Compile model
      this.model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Train
      await this.model.fit(xNorm, yNorm, {
        epochs: 50,
        batchSize: 4,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
            }
          }
        }
      });

      // Store normalization params
      this.xMean = await xMean.data();
      this.xStd = await xStd.data();
      this.yMean = await yMean.data();
      this.yStd = await yStd.data();

      // Cleanup tensors
      xTensor.dispose();
      yTensor.dispose();
      xNorm.dispose();
      yNorm.dispose();
      xMean.dispose();
      xStd.dispose();
      yMean.dispose();
      yStd.dispose();

      this.isModelReady = true;
      console.log('Model trained successfully');
      return true;
    } catch (error) {
      console.error('Error training model:', error);
      return false;
    }
  }

  // Predict future values
  async predict(steps = 7) {
    if (!this.isModelReady || !this.model) {
      console.warn('Model not ready');
      return [];
    }

    try {
      const predictions = [];
      const baseIndex = 0; // Current time index

      for (let i = 1; i <= steps; i++) {
        const futureIndex = baseIndex + i;
        
        // Normalize input
        const xNorm = (futureIndex - this.xMean[0]) / this.xStd[0];
        const xTensor = tf.tensor2d([xNorm], [1, 1]);

        // Predict
        const yNormPred = this.model.predict(xTensor);
        const yNormData = await yNormPred.data();

        // Denormalize
        const prediction = yNormData[0] * this.yStd[0] + this.yMean[0];

        predictions.push({
          day: i,
          value: Math.max(0, Math.min(100, prediction)) // Clamp to 0-100
        });

        xTensor.dispose();
        yNormPred.dispose();
      }

      return predictions;
    } catch (error) {
      console.error('Error making prediction:', error);
      return [];
    }
  }

  // Get model summary
  getModelSummary() {
    if (this.model) {
      this.model.summary();
      return {
        trainable: this.model.trainableWeights.length,
        nonTrainable: this.model.nonTrainableWeights.length,
        ready: this.isModelReady
      };
    }
    return null;
  }

  // Dispose model
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelReady = false;
    }
  }
}

// Singleton instance
const predictionService = new PredictionService();

export default predictionService;
