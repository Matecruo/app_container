<?php

class cet extends __base__ {
  public function getData(){
    // set_time_limit(40);
    // $this->Curl->get()->direct
    //       ->url('http://www.chsi.com.cn/cet/',array())
    //       ->referer('http://www.chsi.com.cn/cet/')
    // ->getResponse();

    return $this->Curl->get()->direct
          ->url('http://www.chsi.com.cn/cet/query',array(
            'zkzh' => $this->id ,
            'xm'=> $this->name))
          ->referer('http://www.chsi.com.cn/cet/')
    ->getResponse();
  }
  public function parse(){
    if(strpos($this->raw,'数据库连接异常') !== false)
      return '数据库连接异常';

    $grade = array( 'id' => $this->id );

    foreach($this->dom->getElementsByTagName('table') as $table){
      if($table->getAttribute('class') == 'cetTable'){
        $trs = $table->getElementsByTagName('tr');
        $grade['name'] = $trs->item(0)->getElementsByTagName('td')->item(0)->textContent;
        $grade['school'] = $trs->item(1)->getElementsByTagName('td')->item(0)->textContent;
        $grade['examType'] = $trs->item(2)->getElementsByTagName('td')->item(0)->textContent;
        $grade['total'] = $trs->item(5)->getElementsByTagName('td')->item(0)->textContent;
        $grade['listening'] = $trs->item(6)->getElementsByTagName('td')->item(1)->textContent;
        $grade['reading'] = $trs->item(7)->getElementsByTagName('td')->item(1)->textContent;
        $grade['writing'] = $trs->item(8)->getElementsByTagName('td')->item(1)->textContent;
        $grade['oral'] = $trs->item(11)->getElementsByTagName('td')->item(0)->textContent;
        foreach($grade as &$value)
          $value = trim($value);
      }
    }
    return $grade;
  }
  public function store(){
    $this->edu_cetModel->write($this->data);
  }
  public function get($id ,$name){
    //如果同时涉及同一个作用域里面读和写操作是一致的话,那么只能手动new model了
    $entry = new edu_cetModel;
    $entry->findOne('id = ? and name = ?',array($id,$name));
    if($entry->success() && $entry->total !== null){
      return $entry->{0};
    }else{
      $this->id = $id;
      $this->name = $name;
      
      if(isset($this->data['total'])){
        $this->store();
        return (object)$this->data;
      }else
        return false;
    }
  }
  
}