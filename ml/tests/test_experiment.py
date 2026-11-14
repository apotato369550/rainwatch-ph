import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
import pandas as pd
import joblib
from common import FEATURES, split, dates
from train import fit
from evaluate import metrics
from fetch_training_data import frame, download

class ExperimentTests(unittest.TestCase):
    def test_calendar_and_split(self):
        self.assertEqual(len(dates('2024-02')),29)
        df=pd.DataFrame({'target_time':pd.date_range('2025-06-01',periods=720,freq='h',tz='UTC')})
        train,test=split(df)
        self.assertEqual((len(train),len(test)),(480,216))
        self.assertGreater((test.target_time.min()-train.target_time.max()).total_seconds(),86400)

    def test_training_only_and_serialization(self):
        train=pd.DataFrame({f:[1.,2.,3.] for f in FEATURES})
        train['reference_precipitation']=[0.,1.,2.]
        model=fit(train)
        self.assertTrue(np.all(model.named_steps['standardscaler'].mean_==2))
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'model';joblib.dump(model,p)
            np.testing.assert_allclose(model.predict(train[FEATURES]),joblib.load(p).predict(train[FEATURES]))
        train[FEATURES[0]]=np.nan
        with self.assertRaises(ValueError):fit(train)

    def test_metrics_edge_cases(self):
        m=metrics(np.zeros(3),np.zeros(3))
        self.assertIsNone(m['r2']);self.assertIsNone(m['heavy_5']['recall'])
        self.assertEqual(m['mae'],0)

    def test_provider_validation(self):
        response=dict(utc_offset_seconds=0,hourly_units={'precipitation':'mm'},hourly={'time':['2025-06-01T00:00']*2,'precipitation':[0,1]})
        with self.assertRaises(ValueError):frame(response,['precipitation'])
        response['hourly_units']['precipitation']='inch'
        with self.assertRaises(ValueError):frame(response,['precipitation'])

    @patch('fetch_training_data.time.sleep')
    @patch('fetch_training_data.requests.get')
    def test_retries_and_cache(self,get,sleep):
        import requests
        get.side_effect=requests.Timeout()
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'cache.json'
            with self.assertRaises(requests.Timeout):download('url',{},p,lambda r:None)
            self.assertEqual(get.call_count,3)
            get.reset_mock();get.side_effect=None
            get.return_value=Mock(status_code=200,json=lambda:{'ok':True})
            download('url',{},p,lambda r:None)
            download('url',{},p,lambda r:None)
            self.assertEqual(get.call_count,1)


class DataContractTests(unittest.TestCase):
    def test_missing_targets_and_rainfall_are_rejected(self):
        import common
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'sample.csv'
            targets=pd.date_range('2025-06-01',periods=720,freq='h',tz='UTC')
            df=pd.DataFrame({'target_time':targets,'raw_precipitation':0.,'reference_precipitation':0.})
            with patch.object(common,'paths',return_value=(path,None,None)):
                df.iloc[:-1].to_csv(path,index=False)
                with self.assertRaises(ValueError):common.load('2025-06')
                df.loc[0,'reference_precipitation']=np.nan
                df.to_csv(path,index=False)
                with self.assertRaises(ValueError):common.load('2025-06')

class PipelineTests(unittest.TestCase):
    def test_full_pipeline_and_changed_dataset(self):
        import common, train, evaluate, json
        with tempfile.TemporaryDirectory() as d, patch.object(common, 'ROOT', Path(d)):
            path, model, report=common.paths('2025-06')
            path.parent.mkdir(parents=True)
            df=pd.DataFrame({f:np.arange(720,dtype=float)%7 for f in FEATURES})
            df['target_time']=pd.date_range('2025-06-01',periods=720,freq='h',tz='UTC')
            df['reference_precipitation']=df.raw_precipitation/2
            df.to_csv(path,index=False)
            with patch('builtins.print'):
                train.main('2025-06');evaluate.main('2025-06')
            result=json.loads(report.read_text())
            self.assertEqual(result['rows'],216)
            predictions=pd.read_csv(report.with_name(report.stem+'-predictions.csv'))
            self.assertTrue((predictions.ridge_precipitation>=0).all())
            path.write_text(path.read_text()+'\n')
            with self.assertRaises(ValueError):evaluate.main('2025-06')

if __name__=='__main__':
    unittest.main()
