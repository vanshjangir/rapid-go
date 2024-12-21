import { useEffect } from "react";
import { useParams } from "react-router-dom";

const Profile = () => {
  const { username } = useParams();
  const httpapi = import.meta.env.VITE_HTTP_URL
  const getData = async () => {
    const response = await fetch(httpapi + `/profile?username=${username}`, {
      method: "GET"
    });
  }

  useEffect(() => {
    getData();
  })
  
  return ( 
    <>
      Hello from profile I am {username}
    </>
  )
}

export default Profile;
